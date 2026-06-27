/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";

const BatchesView = lazy(() => import("./views/BatchesView").then((module) => ({ default: module.BatchesView })));
const SearchView = lazy(() => import("./views/SearchView").then((module) => ({ default: module.SearchView })));
const HistoryView = lazy(() => import("./views/HistoryView").then((module) => ({ default: module.HistoryView })));
const SettingsView = lazy(() => import("./views/SettingsView").then((module) => ({ default: module.SettingsView })));
const DocumentDetailView = lazy(() => import("./views/DocumentDetailView").then((module) => ({ default: module.DocumentDetailView })));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-on-surface-variant bg-surface-container-lowest border border-outline-variant rounded-none">
      Loading view...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/search" replace />} />
            <Route path="batches" element={<BatchesView />} />
            <Route path="search" element={<SearchView />} />
            <Route path="history" element={<HistoryView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="documents" element={<div className="p-8">Documents Placeholder</div>} />
            <Route path="help" element={<div className="p-8">Help Placeholder</div>} />
          </Route>
          <Route path="/document/:id" element={<DocumentDetailView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
