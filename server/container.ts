import { mkdirSync } from "node:fs";
import path from "node:path";
import { SqliteRepository } from "./repositories/sqlite-repository";
import { WorkspaceService } from "./services/workspace-service";
import { seedDemo } from "./db/seed";

let repository: SqliteRepository | undefined;
export function workspaceRepository() { workspaceService(); return repository!; }
let service: WorkspaceService | undefined;
export function workspaceService() {
  if (!service) {
    const filename = process.env.SQLITE_PATH || path.join(process.cwd(), "data/iriva.sqlite");
    mkdirSync(path.dirname(filename), { recursive: true });
    const repo = new SqliteRepository(filename);
    repository = repo;
    seedDemo(repo);
    service = new WorkspaceService(repo);
  }
  return service;
}
