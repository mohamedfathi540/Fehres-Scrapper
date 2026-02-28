import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MainLayout } from "./components/layout/MainLayout";
import { ChatPage } from "./pages/ChatPage";
import { LibraryDocsPage } from "./pages/LibraryDocsPage";
import { IndexInfoPage } from "./pages/IndexInfoPage";
import { SearchPage } from "./pages/SearchPage";
import { ScrapeProgressProvider } from "./stores/ScrapeProgressContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScrapeProgressProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<ChatPage />} />
              <Route path="library-docs" element={<LibraryDocsPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="index" element={<IndexInfoPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ScrapeProgressProvider>
    </QueryClientProvider>
  );
}

export default App;
