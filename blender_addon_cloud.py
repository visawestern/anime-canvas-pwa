bl_info = {
    "name": "Hunyuan3D-2 Cloud Generator",
    "author": "Tencent Hunyuan3D (cloud patch)",
    "version": (2, 0),
    "blender": (3, 0, 0),
    "location": "View3D > Sidebar > Hunyuan3D-2-Cloud",
    "description": "Generate 3D models via local API server OR free HF cloud queue (turbo-minimal)",
    "category": "3D View",
}
"""Cloud-capable fork of Tencent's blender_addon.py.

Two modes:
  LOCAL — original behaviour: POST to api_server.py at API URL (needs own GPU).
  CLOUD — free HuggingFace queue via gradio_client, no local GPU needed.
    Tested 2026-10-10 against tencent/Hunyuan3D-2 /shape_generation
    with turbo-minimal params: steps=5, octree=128, guidance=5.0, rembg=True.
    NOTE: tencent/Hunyuan3D-2mini-Turbo Space currently answers
    "Internal Server Error" on API info, so default cloud Space is
    tencent/Hunyuan3D-2 with steps=5 (= turbo regime, ~2-3 s shape).

Blender's Python needs: <blender_python> -m pip install "gradio_client==0.16.4"
(newer 1.x/2.x clients fail against the server's gradio 4.44 with
"FileData() argument after ** must be a mapping" error — verified).
"""
import base64
import os
import tempfile
import threading

import bpy
import requests
from bpy.props import StringProperty, BoolProperty, IntProperty, FloatProperty, EnumProperty


class Hunyuan3DCloudProperties(bpy.types.PropertyGroup):
    mode: EnumProperty(
        name="Mode",
        description="LOCAL: your own api_server.py / CLOUD: free HF queue",
        items=[("LOCAL", "Local API", ""), ("CLOUD", "Cloud (free queue)", "")],
        default="CLOUD",
    )
    api_url: StringProperty(
        name="API URL (local)",
        description="URL of local api_server.py (LOCAL mode only)",
        default="http://localhost:8080",
    )
    hf_space: StringProperty(
        name="HF Space",
        description="HuggingFace Space id (CLOUD mode)",
        default="tencent/Hunyuan3D-2",
    )
    hf_token: StringProperty(
        name="HF Token (optional)",
        description="HuggingFace token, helps with ZeroGPU quota",
        default="",
        subtype="PASSWORD",
    )
    prompt: StringProperty(name="Text Prompt", default="")
    image_path: StringProperty(name="Image", subtype="FILE_PATH")
    octree_resolution: IntProperty(
        name="Octree Resolution", default=128, min=16, max=512,
        description="128 = minimal/fast, 256 = standard",
    )
    num_inference_steps: IntProperty(
        name="Inference Steps", default=5, min=1, max=100,
        description="5 = turbo regime (verified ~2s shape)",
    )
    guidance_scale: FloatProperty(name="Guidance Scale", default=5.0, min=1.0, max=15.0)
    seed: IntProperty(name="Seed", default=777, min=0, max=10000000)
    texture: BoolProperty(
        name="Generate Texture",
        default=False,
        description="Cloud shape endpoint returns white mesh; texture needs local GPU",
    )
    is_processing: BoolProperty(default=False)
    status_message: StringProperty(default="")


def _resolve_image_path(image_path):
    if image_path.startswith("//"):
        blend_dir = os.path.dirname(bpy.data.filepath)
        image_path = os.path.join(blend_dir, image_path[2:])
    return image_path


def cloud_generate_shape(hf_space, hf_token, image_path, caption,
                         steps, guidance, seed, octree):
    """Call HF Space /shape_generation, return local .glb path + stats dict."""
    try:
        from gradio_client import Client
    except ImportError as e:
        raise RuntimeError(
            "gradio_client missing in Blender Python. Run: "
            "<blender_python> -m pip install \"gradio_client==0.16.4\""
        ) from e
    kwargs = {}
    if hf_token:
        kwargs["hf_token"] = hf_token
    client = Client(hf_space, **kwargs)
    result = client.predict(
        caption or None,
        image_path if image_path else None,
        None, None, None, None,  # mv views
        steps,
        float(guidance),
        int(seed),
        int(octree),
        True,   # check_box_rembg
        8000,   # num_chunks (minimal)
        False,  # randomize_seed (reproducible, avoids cache confusion)
        api_name="/shape_generation",
    )
    file_update, _html, stats, _seed = result
    # file_update is {'value': '/tmp/.../white_mesh.glb', '__type__': 'update'}
    if isinstance(file_update, dict):
        glb_path = file_update.get("value")
    else:
        glb_path = str(file_update)
    if not glb_path or not os.path.exists(glb_path):
        raise RuntimeError(f"Cloud returned no file: {str(result)[:300]}")
    return glb_path, stats


class HUNYUAN_OT_generate_cloud(bpy.types.Operator):
    bl_idname = "object.hunyuan_cloud_generate"
    bl_label = "Generate 3D Model"
    bl_description = "Generate via local API or free HF cloud queue"

    thread = None
    task_finished = False

    def modal(self, context, event):
        if event.type in {"RIGHTMOUSE", "ESC"}:
            return {"CANCELLED"}
        if self.task_finished:
            self.task_finished = False
            context.scene.hunyuan_cloud_props.is_processing = False
        return {"PASS_THROUGH"}

    def invoke(self, context, event):
        props = context.scene.hunyuan_cloud_props
        if not props.prompt and not props.image_path:
            self.report({"WARNING"}, "Enter text or select image first.")
            return {"FINISHED"}
        if props.image_path:
            p = _resolve_image_path(props.image_path)
            if not os.path.exists(p):
                self.report({"ERROR"}, f"Image not found: {p}")
                return {"FINISHED"}
        props.is_processing = True
        props.status_message = (
            "Cloud queue: uploading + ~3-60s generation..."
            if props.mode == "CLOUD"
            else "Local API: generating..."
        )
        self.thread = threading.Thread(target=self._run, args=[context])
        self.thread.start()
        context.window_manager.modal_handler_add(self)
        return {"RUNNING_MODAL"}

    def _run(self, context):
        props = context.scene.hunyuan_cloud_props
        try:
            if props.mode == "CLOUD":
                img = _resolve_image_path(props.image_path) if props.image_path else None
                glb_path, stats = cloud_generate_shape(
                    props.hf_space, props.hf_token, img,
                    props.prompt, props.num_inference_steps,
                    props.guidance_scale, props.seed,
                    props.octree_resolution,
                )
                faces = (stats or {}).get("number_of_faces", "?")
                self.report({"INFO"}, f"Cloud OK: faces={faces} seed={props.seed}")

                def import_handler():
                    bpy.ops.import_scene.gltf(filepath=glb_path)
                    return None

                bpy.app.timers.register(import_handler)
            else:
                # Original LOCAL behaviour (unchanged protocol).
                base_url = props.api_url.rstrip("/")
                if props.image_path:
                    with open(_resolve_image_path(props.image_path), "rb") as f:
                        img_b64 = base64.b64encode(f.read()).decode()
                    payload = {"image": img_b64}
                else:
                    payload = {"text": props.prompt}
                payload.update({
                    "octree_resolution": props.octree_resolution,
                    "num_inference_steps": props.num_inference_steps,
                    "guidance_scale": props.guidance_scale,
                    "texture": props.texture,
                })
                resp = requests.post(f"{base_url}/generate", json=payload)
                if resp.status_code != 200:
                    self.report({"ERROR"}, f"Local API failed: {resp.text[:300]}")
                    return
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".glb")
                tmp.write(resp.content)
                tmp.close()

                def import_local():
                    bpy.ops.import_scene.gltf(filepath=tmp.name)
                    os.unlink(tmp.name)
                    return None

                bpy.app.timers.register(import_local)
        except Exception as e:
            self.report({"ERROR"}, f"Error: {str(e)[:500]}")
        finally:
            self.task_finished = True
            props.is_processing = False


class HUNYUAN_PT_cloud_panel(bpy.types.Panel):
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Hunyuan3D-2-Cloud"
    bl_label = "Hunyuan3D-2 Cloud Generator"

    def draw(self, context):
        layout = self.layout
        props = context.scene.hunyuan_cloud_props
        layout.prop(props, "mode")
        if props.mode == "CLOUD":
            layout.prop(props, "hf_space")
            layout.prop(props, "hf_token")
        else:
            layout.prop(props, "api_url")
        layout.prop(props, "prompt")
        layout.prop(props, "image_path")
        layout.prop(props, "octree_resolution")
        layout.prop(props, "num_inference_steps")
        layout.prop(props, "guidance_scale")
        layout.prop(props, "seed")
        row = layout.row()
        row.enabled = not props.is_processing
        row.operator("object.hunyuan_cloud_generate")
        if props.is_processing:
            layout.label(text=props.status_message or "Processing...")


classes = (Hunyuan3DCloudProperties, HUNYUAN_OT_generate_cloud, HUNYUAN_PT_cloud_panel)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.hunyuan_cloud_props = bpy.props.PointerProperty(type=Hunyuan3DCloudProperties)


def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    del bpy.types.Scene.hunyuan_cloud_props


if __name__ == "__main__":
    register()
