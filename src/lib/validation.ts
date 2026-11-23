import { DateTime } from "luxon";
import { z } from "zod";

export const BirthInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    birthTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
    timeZone: z.string().min(1).max(64),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    placeLabel: z.string().trim().min(1).max(200),
    gender: z.enum(["male", "female", "other"]).nullable().optional(),
  })
  .refine((b) => DateTime.local().setZone(b.timeZone).isValid, { message: "unknown time zone", path: ["timeZone"] })
  .refine(
    (b) => {
      const d = DateTime.fromISO(b.birthDate, { zone: b.timeZone });
      return d.isValid && d.year >= 1800 && d <= DateTime.now().setZone(b.timeZone);
    },
    { message: "invalid birth date", path: ["birthDate"] },
  );
export type BirthInput = z.infer<typeof BirthInput>;
