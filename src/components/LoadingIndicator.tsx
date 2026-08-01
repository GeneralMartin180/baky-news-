interface LoadingIndicatorProps {
  ariaLabel?: string;
  label?: string;
}

export function LoadingIndicator({
  ariaLabel = 'Načítavam',
  label = 'Načítavam',
}: LoadingIndicatorProps) {
  return (
    <div className="loader" role="status" aria-label={ariaLabel}>
      <span className="loader-text">{label}</span>
      <span className="load" />
    </div>
  );
}
