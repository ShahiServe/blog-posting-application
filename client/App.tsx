import "./global.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ShopifyDiagnostics from "./pages/ShopifyDiagnostics";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/blog/create" element={<Index />} />
        <Route path="/blog/generator" element={<Index />} />
        <Route path="/diagnostics/shopify" element={<ShopifyDiagnostics />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
