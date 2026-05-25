# Forms (react-hook-form + Zod)

Read when adding a form, mapping server errors, or wiring submit
state.

```ts
// Component.hooks.ts
const schema = z.object({ email: z.string().email() });
const {
  register,
  handleSubmit,
  setError,
  formState: { errors, isSubmitting }
} = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

const onSubmit = useCallback(
  async (input) => {
    try {
      await mutation.mutateAsync(input);
    } catch (error) {
      if (!applyServerErrors(error, setError)) {
        toast.error(t("auth.login.errors.network"));
      }
    }
  },
  [mutation, setError, t]
);
```

`applyServerErrors` (in `@/features/auth/Auth.utils.ts`) maps an
`ApiError`'s `fieldErrors` map onto RHF field-level errors. Use it
for every form — never branch on individual field codes by hand.
