import { Link } from 'react-router-dom';

type PageBackProps = {
  to: string;
  'aria-label'?: string;
};

/** Consistent back control for learner pages (always a Link for SPA navigation). */
export function PageBack({ to, 'aria-label': ariaLabel }: PageBackProps) {
  return (
    <Link to={to} className="page-back" aria-label={ariaLabel ?? 'Back'}>
      ←
    </Link>
  );
}
