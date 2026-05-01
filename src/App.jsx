/**
 * 宝贝时光 - 主应用组件
 * 记录宝宝成长点滴的移动端单页应用
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './store/AppContext';
import { MusicProvider } from './store/MusicContext';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { LoadingSkeleton } from './components/LoadingSkeleton';
      
      {/* 动态表单 */}
      {showMomentForm && (
        <MomentForm
          moment={editingMoment}
          babyId={currentBaby?.id}
          onSave={handleSaveMoment}
          onCancel={() => {
            setShowMomentForm(false);
            setEditingMoment(null);
          }}
        />
      )}
      
      {/* 时空胶囊页面 */}
      {showCapsulesPage && (
        <CapsulesPage
          onClose={() => setShowCapsulesPage(false)}
          onAddCapsule={handleAddCapsule}
          onEditCapsule={handleEditCapsule}
        />
      )}
      
      {/* 胶囊表单 */}
      {showCapsuleForm && (
        <CapsuleForm
          capsule={editingCapsule}
          babyId={currentBaby?.id}
          onSave={handleSaveCapsule}
          onCancel={() => {
            setShowCapsuleForm(false);
            setEditingCapsule(null);
          }}
        />
      )}
      
      {/* 宝宝表单 */}
      {showBabyForm && (
        <BabyForm
          baby={editingBaby}
          onSave={handleSaveBaby}
          onCancel={() => {
            setShowBabyForm(false);
            setEditingBaby(null);
          }}
        />
      )}
    </div>
  );
}

// 路由配置
function AppRoutes() {
  const { isLoggedIn, isLoading, login } = useApp();
  
  if (isLoading) {
    return <LoadingSkeleton />;
  }
  
  return (
    <Routes>
      {/* 公开路由 */}
      <Route 
        path="/login" 
        element={
          isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={login} />
          )
        } 
      />
      <Route 
        path="/register" 
        element={
          isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <RegisterPage onRegister={login} />
          )
        } 
      />
      {/* 访客打卡页面（公开访问） */}
      <Route path="/invite" element={<InvitePage />} />
      
      {/* 受保护的路由 */}
      <Route
        path="/*"
        element={
          <AuthGuard>
            <AppContent />
          </AuthGuard>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <MusicProvider>
          <AppRoutes />
        </MusicProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
