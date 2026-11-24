import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig(({ mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // `vite preview`는 기본 mode가 production이라 .env.development를 읽지 않습니다.
  // 로컬에서 빌드 결과를 확인할 때도 개발 서버와 같은 백엔드로 /api를 전달하도록 development 값을 함께 확인합니다.
  const proxyTarget = (
    env.VITE_API_PROXY_TARGET ||
    (isPreview ? loadEnv('development', process.cwd(), '').VITE_API_PROXY_TARGET : '')
  )?.trim();
  const apiProxy: Record<string, ProxyOptions> | undefined = proxyTarget
    ? {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest) => {
              proxyRequest.removeHeader('origin');
            });
          },
        },
      }
    : undefined;

  return {
    plugins: [react()],
    server: apiProxy
      ? {
          watch: env.VITE_DEV_POLL === 'true' ? { usePolling: true, interval: 500 } : undefined,
          proxy: apiProxy,
        }
      : undefined,
    preview: apiProxy ? { proxy: apiProxy } : undefined,
    test: {
      // 기본 제외 규칙은 그대로 두고, 프로젝트 안에 생기는 Claude 작업 트리(.claude/worktrees 등)만 더 뺍니다.
      exclude: [...configDefaults.exclude, '**/.claude/**'],
    },
  };
});
