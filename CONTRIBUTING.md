# Contributing to FlowEngine Portal

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `npm install`
3. Run `./setup.sh` — auto-generates all secrets and creates `.env`
4. Start Supabase and all services: `docker compose up -d`
5. Run the dev server: `npm run dev`
6. Open [http://localhost:3000](http://localhost:3000)

Supabase (Postgres, Auth, REST API, Storage) is included in the Docker Compose file — no external account needed. The setup script generates all JWT keys and passwords automatically.

## Making Changes

1. Create a branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Test locally with `npm run dev`
4. Verify the build: `npm run build`
5. Submit a pull request

## Code Style

- We use Tailwind CSS 4 with a dark theme. See the design system in the codebase.
- Use `text-sm` as minimum text size for readable content
- Use `SearchableSelect` instead of native `<select>` elements
- Keep components simple and focused

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include browser and OS info
- Screenshots help

## Pull Requests

- Keep PRs focused on a single change
- Describe what you changed and why
- Reference any related issues

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT with Commons Clause).
