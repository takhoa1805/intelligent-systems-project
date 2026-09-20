import { recordEvent } from './event.service.js';

export async function create(req, res) {
  res.status(201).json(await recordEvent(req.body));
}
