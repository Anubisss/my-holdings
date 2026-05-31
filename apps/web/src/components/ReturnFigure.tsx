import { signColorClass, signOf, formatSignedPercent } from '../lib/format';
import { dash } from './placeholders';

type ReturnFigureProps = {
  /** Raw, unformatted return value used to pick the sign color. */
  rawValue: string | null;
  /** Pre-formatted money string shown to the user. */
  display: string | null;
  percent: number | null;
};

export const ReturnFigure = ({ rawValue, display, percent }: ReturnFigureProps) => {
  if (display === null) return dash;
  return (
    <span className={`font-semibold tabular-nums ${signColorClass(signOf(rawValue))}`}>
      {display} ({formatSignedPercent(percent)})
    </span>
  );
};
