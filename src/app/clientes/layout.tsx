import './clientes-mobile.css';
import './princess.css';
import './ticket-summary.css';
import ClientesOrganizer from './ClientesOrganizer';

export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="clientes-mobile">
      <ClientesOrganizer />
      {children}
    </div>
  );
}
