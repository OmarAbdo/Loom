/** Renders the standard `{ message, field? }[]` error envelope from the APIs. */
export function Errors({ errors }: { errors: { message: string; field?: string }[] | null }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="errors">
      <strong>Oops —</strong>
      <ul>
        {errors.map((e, i) => (
          <li key={i}>{e.message}</li>
        ))}
      </ul>
    </div>
  );
}
