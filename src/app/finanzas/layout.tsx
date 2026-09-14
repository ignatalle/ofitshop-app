import './mobile.css';
import './princess.css';
import './modal-fix.css';

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return <div className="finanzas-mobile-shell">{children}</div>;
}
