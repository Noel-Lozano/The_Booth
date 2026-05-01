interface RuleCitationProps {
  citation: string;
}

export function RuleCitation({ citation }: RuleCitationProps) {
  return (
    <li className="flex items-start gap-2 text-sm text-white/70">
      <span className="mt-0.5 text-yellow-400 shrink-0">§</span>
      <span>{citation}</span>
    </li>
  );
}
