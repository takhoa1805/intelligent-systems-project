import { getOverview } from './admin.repository.js';
import {
  createProduct,
  listAdminProducts,
  removeProduct,
  updateProduct,
} from '../products/product.service.js';

export async function overview(_req, res) {
  res.json(await getOverview());
}

export async function createProductForAdmin(req, res) {
  res.status(201).json(await createProduct(req.body));
}

export async function products(_req, res) {
  res.json(await listAdminProducts());
}

export async function updateProductForAdmin(req, res) {
  res.json(await updateProduct(req.params.id, req.body));
}

export async function removeProductForAdmin(req, res) {
  await removeProduct(req.params.id);
  res.status(204).end();
}
