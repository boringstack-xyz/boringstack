import { z } from "zod";

import { ROLE } from "@/lib/acl/acl.types";

export const inviteMemberSchema = z.object({
  email: z.email("Please enter a valid email."),
  roleToAssign: z.enum([ROLE.admin, ROLE.member, ROLE.viewer])
});
