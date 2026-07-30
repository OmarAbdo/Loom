import { Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { LandingPage } from './pages/LandingPage';
import { SignupPage } from './pages/SignupPage';
import { SigninPage } from './pages/SigninPage';
import { NewTicketPage } from './pages/NewTicketPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderShowPage } from './pages/OrderShowPage';

/** App shell: header + routed pages. */
export function App() {
  return (
    <>
      <Header />
      <div className="container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />
          <Route path="/auth/signin" element={<SigninPage />} />
          <Route path="/tickets/new" element={<NewTicketPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:orderId" element={<OrderShowPage />} />
        </Routes>
      </div>
    </>
  );
}
