import userService from "../services/user.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/user.schema.js";

export default async function userRoutes(app) {
  app.post("/list", async (req) => {
    return userService.getList(req.body);
  });

  app.post("/:id", async (req) => {
    const params = validate(idParamSchema, req.params);
    return userService.getById(params.id);
  });
}
