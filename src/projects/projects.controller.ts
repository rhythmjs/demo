import { requireSession, type AuthContext } from "@rhythmjs/better-auth";
import { apiBody } from "@rhythmjs/openapi/body";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiParam } from "@rhythmjs/openapi/param";
import { apiQuery } from "@rhythmjs/openapi/query";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiCookieAuth } from "@rhythmjs/openapi/security";
import { apiTags } from "@rhythmjs/openapi/tags";
import { RhythmRouter } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/adapters/context";
import { z } from "zod";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectParamSchema,
  projectSchema,
  updateProjectSchema,
} from "./projects.schema";
import type { ProjectsService } from "./projects.service";

export type ProjectsContext = RhythmHttpContext &
  AuthContext & {
    projectsService: ProjectsService;
  };

const unauthorized = apiResponse(401, { description: "No session" });
const notFound = apiResponse(404, { description: "Project not found" });

export const projectsController = new RhythmRouter<ProjectsContext>({ prefix: "/projects" })
  .use(apiTags("projects"))
  .use(apiCookieAuth("cookieAuth"))
  .use(requireSession())
  .get(
    "/",
    apiQuery(listProjectsQuerySchema),
    apiOperation({ summary: "List my projects", operationId: "listProjects" }),
    apiResponse(200, { description: "Projects owned by the caller", schema: z.array(projectSchema) }),
    unauthorized,
    async (ctx) => {
      ctx.json(await ctx.projectsService.list(ctx.user.id, ctx.valid.query));
    },
  )
  .post(
    "/",
    apiBody(createProjectSchema),
    apiOperation({ summary: "Create a project", operationId: "createProject" }),
    apiResponse(201, { description: "The created project", schema: projectSchema }),
    unauthorized,
    async (ctx) => {
      ctx.json(await ctx.projectsService.create(ctx.user.id, ctx.valid.body), 201);
    },
  )
  .get(
    "/:id",
    apiParam(projectParamSchema),
    apiOperation({ summary: "Get a project", operationId: "getProject" }),
    apiResponse(200, { description: "The project", schema: projectSchema }),
    unauthorized,
    notFound,
    async (ctx) => {
      const project = await ctx.projectsService.get(ctx.user.id, ctx.params.id);
      if (!project) return ctx.error(404, "Project not found");
      ctx.json(project);
    },
  )
  .patch(
    "/:id",
    apiBody(updateProjectSchema),
    apiParam(projectParamSchema),
    apiOperation({ summary: "Update a project", operationId: "updateProject" }),
    apiResponse(200, { description: "The updated project", schema: projectSchema }),
    unauthorized,
    notFound,
    async (ctx) => {
      const project = await ctx.projectsService.update(ctx.user.id, ctx.params.id, ctx.valid.body);
      if (!project) return ctx.error(404, "Project not found");
      ctx.json(project);
    },
  )
  .delete(
    "/:id",
    apiParam(projectParamSchema),
    apiOperation({ summary: "Delete a project and its tasks", operationId: "deleteProject" }),
    apiResponse(204, { description: "Deleted" }),
    unauthorized,
    notFound,
    async (ctx) => {
      if (!(await ctx.projectsService.remove(ctx.user.id, ctx.params.id))) {
        return ctx.error(404, "Project not found");
      }
      ctx.response.status = 204;
    },
  );
