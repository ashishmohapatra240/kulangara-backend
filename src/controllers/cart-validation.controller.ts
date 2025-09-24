import { Request, Response } from 'express';
import { checkStockAvailability, StockItem } from '../services/stock.service';

interface CartItem {
    productId: string;
    variantId?: string;
    quantity: number;
}

interface ValidateCartRequest {
    items: CartItem[];
}

/**
 * Validate cart items for stock availability before checkout
 * This prevents users from proceeding to payment with out-of-stock items
 */
export const validateCartStock = async (
    req: Request<{}, {}, ValidateCartRequest>,
    res: Response
): Promise<void> => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({
                status: 'error',
                message: 'Cart items are required'
            });
            return;
        }

        // Convert cart items to stock items
        const stockItems: StockItem[] = items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity
        }));

        // Check stock availability
        const stockCheck = await checkStockAvailability(stockItems);

        if (!stockCheck.available) {
            res.status(400).json({
                status: 'error',
                message: stockCheck.message || 'Some items are out of stock',
                available: false
            });
            return;
        }

        res.json({
            status: 'success',
            message: 'All items are available',
            available: true
        });
    } catch (error) {
        console.error('Error validating cart stock:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to validate cart stock'
        });
    }
};

/**
 * Get real-time stock information for specific products/variants
 */
export const getStockInfo = async (
    req: Request<{}, {}, {}, { productIds?: string; variantIds?: string; }>,
    res: Response
): Promise<void> => {
    try {
        const { productIds, variantIds } = req.query;

        const stockInfo: any = {
            products: [],
            variants: []
        };

        // Get product stock info
        if (productIds) {
            const productIdArray = productIds.split(',').filter(Boolean);
            
            if (productIdArray.length > 0) {
                const { prisma } = await import('../config/db');
                
                stockInfo.products = await prisma.product.findMany({
                    where: {
                        id: { in: productIdArray },
                        isActive: true
                    },
                    select: {
                        id: true,
                        name: true,
                        stockQuantity: true,
                        lowStockThreshold: true
                    }
                });
            }
        }

        // Get variant stock info
        if (variantIds) {
            const variantIdArray = variantIds.split(',').filter(Boolean);
            
            if (variantIdArray.length > 0) {
                const { prisma } = await import('../config/db');
                
                stockInfo.variants = await prisma.productVariant.findMany({
                    where: {
                        id: { in: variantIdArray },
                        isActive: true
                    },
                    select: {
                        id: true,
                        size: true,
                        color: true,
                        stock: true,
                        product: {
                            select: {
                                name: true
                            }
                        }
                    }
                });
            }
        }

        res.json({
            status: 'success',
            data: stockInfo
        });
    } catch (error) {
        console.error('Error getting stock info:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get stock information'
        });
    }
};
