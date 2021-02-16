import 'reflect-metadata';
require('dotenv-safe').config();
import express from 'express';
import { createConnection } from 'typeorm';
import path from 'path';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { Strategy as GitHubStrategy } from 'passport-github';
import { __PROD__ } from './constants';
import { User } from './entities/User';
import { Todo } from './entities/Todo';
import { isAuth } from './isAuth';

(async () => {
	await createConnection({
		type: 'postgres',
		host: process.env.DB_HOST,
		database: process.env.DB_NAME,
		username: process.env.DB_USERNAME,
		password: process.env.DB_PASSWORD,
		entities: [path.join(__dirname, './entities/*.*')],
		logging: !__PROD__,
		synchronize: !__PROD__,
	});
	const app = express();
	passport.serializeUser(function (user: any, done) {
		done(null, user.accessToken);
	});
	app.use(cors({ origin: '*' }));
	app.use(passport.initialize());
	app.use(express.json());

	passport.use(
		new GitHubStrategy(
			{
				clientID: process.env.GITHUB_CLIENT_ID,
				clientSecret: process.env.GITHUB_CLIENT_SECRET,
				// callbackURL: 'http://localhost:3002/auth/github/callback',
				callbackURL:
					'https://vscode-extension.herokuapp.com/auth/github/callback',
			},
			async (_, __, profile, cb) => {
				let user = await User.findOne({ where: { githubId: profile.id } });
				if (user) {
					user.name = profile.displayName;
					await user.save();
				} else {
					user = await User.create({
						name: profile.displayName,
						githubId: profile.id,
					}).save();
				}
				cb(null, {
					accessToken: jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
						expiresIn: '1y',
					}),
				});
			},
		),
	);

	app.get('/auth/github', passport.authenticate('github', { session: false }));

	app.get(
		'/auth/github/callback',
		passport.authenticate('github', { session: false }),
		(req: any, res) => {
			res.redirect(`http://localhost:54321/auth/${req.user.accessToken}`);
		},
	);

	app.get('/todo', isAuth, async (req: any, res) => {
		const todos = await Todo.find({
			where: { creatorId: req.userId },
			order: { id: 'DESC' },
		});
		res.send({ todos });
	});

	app.post('/todo', isAuth, async (req: any, res) => {
		const todo = await Todo.create({
			text: req.body.text,
			creatorId: req.userId,
		}).save();
		res.send({ todo });
	});

	app.put('/todo', isAuth, async (req: any, res) => {
		const todo = await Todo.findOne(req.body.id);
		if (!todo) {
			res.send({ todo: null });
			return;
		}
		if (todo.creatorId !== req.userId) {
			throw new Error('not authorized');
		}
		todo.completed = !todo.completed;
		await todo.save();
		res.send({ todo });
	});

	app.get('/me', async (req, res) => {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			res.send({ user: null });
			return;
		}

		const token = authHeader.split(' ')[1];
		if (!token) {
			res.send({ user: null });
			return;
		}

		let userId = '';
		try {
			const payload: any = jwt.verify(token, process.env.JWT_SECRET);
			userId = payload.userId;
		} catch (error) {
			res.send({ user: null });
			return;
		}

		if (!userId) {
			res.send({ user: null });
			return;
		}

		const user = await User.findOne(userId);
		res.send({ user });
	});

	app.listen(3002, () => console.log('Server started at 3002'));
})();
