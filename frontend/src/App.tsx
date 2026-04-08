import { BrowserRouter, Routes, Route } from "react-router-dom";

function Home() {
  return <div>Home — PRETSO</div>;
}

function Admin() {
  return <div>Admin Panel</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
