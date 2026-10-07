import { requireSession, type AuthContext } from "@rhythmjs/better-auth";
import { apiBody } from "@rhythmjs/openapi/body";
import { apiOperation } from "@rhythmjs/openapi/operation";
import { apiParam } from "@rhythmjs/openapi/param";
import { apiQuery } from "@rhythmjs/openapi/query";
import { apiResponse } from "@rhythmjs/openapi/response";
import { apiCookieAuth } from "@rhythmjs/openapi/security";
import { apiTags } from "@rhythmjs/openapi/tags";
import { documented } from "@rhythmjs/openapi/generate";
import { RhythmRouter } from "@rhythmjs/router";
import type { RhythmHttpContext } from "@rhythmjs/router/context";
import { z } from "zod";
import {
  createTaskSchema,
  listTasksQuerySchema,
  projectParamSchema,
  taskParamSchema,
  taskSchema,
  updateTaskSchema,
} from "./tasks.schema";
import type { TasksService } from "./tasks.service";

export type TasksContext = RhythmHttpContext &
  AuthContext & {
    tasksService: TasksService;
  };

const unauthorized = apiResponse(401, { description: "No session" });
const notFound = apiResponse(404, { description: "Project or task not found" });

export const tasksController = documented(new RhythmRouter<TasksContext>())
  .use(apiTags("tasks"))
  .use(apiCookieAuth("cookieAuth"))
  .use(requireSession())
  .get(
    "/projects/:projectId/tasks",
    apiQuery(listTasksQuerySchema),
    apiParam(projectParamSchema),
    apiOperation({ summary: "List a project's tasks", operationId: "listTasks" }),
    apiResponse(200, { description: "Tasks of the project", schema: z.array(taskSchema) }),
    unauthorized,
    notFound,
    async (ctx) => {
      const found = await ctx.tasksService.list(ctx.user.id, ctx.params.projectId, ctx.valid.query);
      if (!found) return ctx.error(404, "Project not found");
      ctx.json(found);
    },
  )
  .post(
    "/projects/:projectId/tasks",
    apiBody(createTaskSchema),
    apiParam(projectParamSchema),
    apiOperation({ summary: "Create a task in a project", operationId: "createTask" }),
    apiResponse(201, { description: "The created task", schema: taskSchema }),
    unauthorized,
    notFound,
    async (ctx) => {
      const task = await ctx.tasksService.create(ctx.user.id, ctx.params.projectId, ctx.valid.body);
      if (!task) return ctx.error(404, "Project not found");
      ctx.json(task, 201);
    },
  )
  .get(
    "/projects/:projectId/tasks/:id",
    apiParam(taskParamSchema),
    apiOperation({ summary: "Get a task", operationId: "getTask" }),
    apiResponse(200, { description: "The task", schema: taskSchema }),
    unauthorized,
    notFound,
    async (ctx) => {
      const task = await ctx.tasksService.get(ctx.user.id, ctx.params.projectId, ctx.params.id);
      if (!task) return ctx.error(404, "Task not found");
      ctx.json(task);
    },
  )
  .patch(
    "/projects/:projectId/tasks/:id",
    apiBody(updateTaskSchema),
    apiParam(taskParamSchema),
    apiOperation({ summary: "Update a task", operationId: "updateTask" }),
    apiResponse(200, { description: "The updated task", schema: taskSchema }),
    unauthorized,
    notFound,
    async (ctx) => {
      const task = await ctx.tasksService.update(ctx.user.id, ctx.params.projectId, ctx.params.id, ctx.valid.body);
      if (!task) return ctx.error(404, "Task not found");
      ctx.json(task);
    },
  )
  .delete(
    "/projects/:projectId/tasks/:id",
    apiParam(taskParamSchema),
    apiOperation({ summary: "Delete a task", operationId: "deleteTask" }),
    apiResponse(204, { description: "Deleted" }),
    unauthorized,
    notFound,
    async (ctx) => {
      if (!(await ctx.tasksService.remove(ctx.user.id, ctx.params.projectId, ctx.params.id))) {
        return ctx.error(404, "Task not found");
      }
      ctx.response.status = 204;
    },
  );
