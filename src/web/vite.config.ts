import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import path from 'path'; // ^0.12.7
import viteCompression from 'vite-plugin-compression'; // ^0.5.1
import { visualizer } from 'rollup-plugin-visualizer'; // ^5.9.0

// Production-grade Vite configuration with advanced optimizations
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  
  return {
    root: process.cwd(),
    
    plugins: [
      // React plugin with optimized Fast Refresh
      react({
        fastRefresh: true,
        babel: {
          plugins: isProd ? ['transform-remove-console'] : [],
        },
      }),
      
      // Production-only plugins
      ...(isProd ? [
        // Gzip compression for production builds
        viteCompression({
          algorithm: 'gzip',
          ext: '.gz',
          threshold: 10240, // 10KB
          deleteOriginFile: false,
        }),
        
        // Brotli compression for modern browsers
        viteCompression({
          algorithm: 'brotliCompress',
          ext: '.br',
          threshold: 10240,
          deleteOriginFile: false,
        }),
        
        // Bundle size analysis
        visualizer({
          filename: 'stats.html',
          gzipSize: true,
          brotliSize: true,
          open: false,
        }),
      ] : []),
    ],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@services': path.resolve(__dirname, './src/services'),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'],
      preserveSymlinks: true,
    },
    
    server: {
      port: 3000,
      host: '0.0.0.0',
      cors: {
        origin: [
          'http://localhost:3000',
          process.env.VITE_API_URL,
        ].filter(Boolean),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL,
          changeOrigin: true,
          secure: isProd,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: process.env.VITE_WS_URL,
          ws: true,
          secure: isProd,
        },
      },
      hmr: {
        overlay: true,
        clientPort: 3000,
        protocol: 'ws',
      },
    },
    
    build: {
      target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isProd,
      minify: isProd ? 'terser' : false,
      terserOptions: isProd ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        format: {
          comments: false,
        },
      } : undefined,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'state-vendor': ['redux', '@reduxjs/toolkit', 'react-redux'],
            'ui-vendor': ['@mui/material', '@mui/icons-material'],
          },
          inlineDynamicImports: false,
        },
      },
      cssCodeSplit: true,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
    },
    
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux',
        '@mui/material',
        '@mui/icons-material',
      ],
      exclude: ['@fsevents'],
    },
    
    preview: {
      port: 3000,
      host: '0.0.0.0',
      cors: true,
      headers: {
        'Cache-Control': 'public, max-age=31536000',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      },
    },
    
    // Type checking and environment configuration
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  };
});