export default function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1 text-2xl text-amber-400">
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          onClick={() => onChange(n)}
          className={`fa-star cursor-pointer ${n <= value ? 'fas' : 'far'}`}
        />
      ))}
    </div>
  );
}
