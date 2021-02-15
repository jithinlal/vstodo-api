declare namespace NodeJS {
	export interface ProcessEnv {
		NODE_ENV: string;
		GITHUB_CLIENT_ID: string;
		GITHUB_CLIENT_SECRET: string;
		JWT_SECRET: string;
		DB_HOST: string;
		DB_NAME: string;
		DB_USERNAME: string;
		DB_PASSWORD: string;
	}
}
