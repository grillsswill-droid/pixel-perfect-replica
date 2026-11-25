// Applied after the audit runner strips secrets; make Vite's build mode authentic.
process.env.NODE_ENV = 'production';
