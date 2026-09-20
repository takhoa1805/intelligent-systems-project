import { findCategories } from './category.repository.js';

export async function list(_req, res) {
  res.json(await findCategories());
}
