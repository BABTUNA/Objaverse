type Props = {
  inset?: string;
  size?: string;
};

export default function CornerBrackets({ inset = 'inset-2', size = 'h-3 w-3' }: Props) {
  const corner = `absolute ${size} border-ember-500/40`;
  return (
    <div aria-hidden className={`pointer-events-none absolute ${inset}`}>
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} left-0 bottom-0 border-l border-b`} />
      <span className={`${corner} right-0 bottom-0 border-r border-b`} />
    </div>
  );
}
