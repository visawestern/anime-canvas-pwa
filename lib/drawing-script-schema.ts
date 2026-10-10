import { z } from 'zod';

const StrokeSchema = z.object({
  path: z.string().min(1),
  w: z.number().positive().default(1.5),
  o: z.number().min(0).max(1).default(1),
});

const FillSchema = z.object({
  path: z.string().min(1),
  color: z.string().min(1),
});

const StepKindSchema = z.enum(['pencil', 'ink', 'eraser', 'fill', 'shade']);

const StepSchema = z.object({
  id: z.number().int().positive(),
  kind: StepKindSchema,
  layer: z.string().min(1),
  label: z.string().optional(),
  strokes: z.array(StrokeSchema).optional(),
  fills: z.array(FillSchema).optional(),
  eraseAfter: z.boolean().optional(),
});

export const DrawingScriptSchema = z
  .object({
    style: z.object({
      palette: z.array(z.string().min(1)).min(1),
      linePencil: z.string().min(1),
      lineInk: z.string().min(1),
    }),
    layers: z.array(z.string().min(1)).min(1),
    steps: z.array(StepSchema).min(1),
    rig: z.object({
      bones: z.array(
        z.object({
          name: z.string().min(1),
          from: z.tuple([z.number(), z.number()]),
          to: z.tuple([z.number(), z.number()]),
        }),
      ),
      morphTargets: z.array(z.string()),
    }),
    anim: z.object({
      fps: z.number().int().min(1).max(24),
      loop: z.string(),
      dirtyLayers: z.array(z.string()),
    }),
  })
  .refine((s) => s.anim.dirtyLayers.every((l) => s.layers.includes(l)), {
    message: 'dirtyLayers must reference known layers',
    path: ['anim', 'dirtyLayers'],
  });

export type DrawingScript = z.infer<typeof DrawingScriptSchema>;
export type DrawStep = z.infer<typeof StepSchema>;
