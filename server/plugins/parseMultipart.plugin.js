export async function parseMultipart(req) {
  const parts = req.parts();

  const fields = {};
  const files = [];

  for await (const part of parts) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();

      files.push({
        fieldname: part.fieldname,
        buffer,
        filename: part.filename,
        originalname: part.filename, // 👈 추가
        mimetype: part.mimetype,
      });
    } else {
      if (fields[part.fieldname]) {
        if (Array.isArray(fields[part.fieldname])) {
          fields[part.fieldname].push(part.value);
        } else {
          fields[part.fieldname] = [fields[part.fieldname], part.value];
        }
      } else {
        fields[part.fieldname] = part.value;
      }
    }
  }

  return { fields, files };
}
