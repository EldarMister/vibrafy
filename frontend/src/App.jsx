import { AdminApp } from "./AdminApp.jsx";
import { ClientApp } from "./ClientApp.jsx";

export default function App() {
  const isAdminRoute = window.location.pathname.startsWith("/admin");
  return isAdminRoute ? <AdminApp /> : <ClientApp />;
}

