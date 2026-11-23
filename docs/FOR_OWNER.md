# For the owner

Asks that only a person can answer or do: an account, a secret, a consent
screen, a product decision, anything that touches production. The factory's
agents write an entry here instead of guessing, and point to it from the issue
they are blocked on.

The person who runs this repository works through the list, in order. When an
entry is done, delete it; the git history keeps it.

## Format

Each entry is a level-2 heading, then these five fields, in this order:

```
## <a short ask, as a request: "Add the Stripe test key to the staging secrets">

- **What:** the exact thing to do, in one or two sentences.
- **Why:** the issue or build it unblocks (link it), and what breaks without it.
- **Steps:** the numbered steps a person takes, with the place each one happens.
- **Risk:** low, medium or high, and why in a few words.
- **Undo:** how to reverse it, or "nothing to undo" when that is true.
```

A new entry goes at the bottom of **Open asks**. Never put a secret, a
password or a customer's data in an entry: name where the value lives instead.

## Open asks

None.
