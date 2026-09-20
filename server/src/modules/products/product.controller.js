import * as productService from './product.service.js';

export async function list(req, res) {
  res.json(await productService.listProducts(req.query));
}

export async function getById(req, res) {
  res.json(await productService.getProduct(req.params.id));
}

export async function create(req, res) {
  res.status(201).json(await productService.createProduct(req.body));
}
