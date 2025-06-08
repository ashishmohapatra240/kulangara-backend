import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { cacheWrapper } from '../services/cache.service';
import { IAnalyticsFilters, IDashboardStats, IOrderAnalytics } from '../types/analytics.types';
import { OrderStatus, Prisma } from '@prisma/client';

// Cache keys
const CACHE_KEYS = {
    ANALYTICS: (query: any) => `analytics:${JSON.stringify(query)}`,
    DASHBOARD: 'admin:dashboard',
    ORDER_ANALYTICS: 'orders:analytics'
};

// Get analytics data
export const getAnalytics = async (
    req: Request<{}, {}, {}, IAnalyticsFilters>,
    res: Response
): Promise<void> => {
    try {
        const {
            startDate,
            endDate,
            type,
            event,
            userId,
            page = 1,
            limit = 50
        } = req.query;

        const normalizedQuery = {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            type,
            event,
            userId,
            page: Number(page),
            limit: Number(limit)
        };

        const result = await cacheWrapper(
            CACHE_KEYS.ANALYTICS(normalizedQuery),
            async () => {
                const where = {
                    createdAt: {
                        gte: normalizedQuery.startDate,
                        lte: normalizedQuery.endDate
                    },
                    type: normalizedQuery.type,
                    event: normalizedQuery.event,
                    userId: normalizedQuery.userId
                };

                const [analytics, total] = await Promise.all([
                    prisma.analytics.findMany({
                        where,
                        orderBy: { createdAt: 'desc' },
                        skip: (normalizedQuery.page - 1) * normalizedQuery.limit,
                        take: normalizedQuery.limit
                    }),
                    prisma.analytics.count({ where })
                ]);

                return {
                    data: analytics,
                    meta: {
                        total,
                        page: normalizedQuery.page,
                        limit: normalizedQuery.limit,
                        totalPages: Math.ceil(total / normalizedQuery.limit)
                    }
                };
            },
            60 // Cache for 1 minute
        );

        res.json({
            status: 'success',
            ...result
        });
    } catch (error) {
        console.error('Error in getAnalytics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch analytics data'
        });
    }
};

// Get dashboard stats
export const getDashboardStats = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const result = await cacheWrapper(
            CACHE_KEYS.DASHBOARD,
            async () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const [
                    totalUsers,
                    activeUsers,
                    newUsersToday,
                    usersByStatus,
                    totalOrders,
                    ordersToday,
                    orderStats,
                    products,
                    outOfStockProducts,
                    lowStockProducts
                ] = await Promise.all([
                    // Total users
                    prisma.user.count(),

                    // Active users
                    prisma.user.count({
                        where: { isActive: true }
                    }),

                    // New users today
                    prisma.user.count({
                        where: {
                            createdAt: {
                                gte: today
                            }
                        }
                    }),

                    // Users by status
                    prisma.user.groupBy({
                        by: ['isActive'],
                        _count: true
                    }),

                    // Total orders
                    prisma.order.count(),

                    // Orders today
                    prisma.order.count({
                        where: {
                            createdAt: {
                                gte: today
                            }
                        }
                    }),

                    // Order stats
                    prisma.order.aggregate({
                        _sum: {
                            totalAmount: true
                        },
                        _avg: {
                            totalAmount: true
                        },
                        where: {
                            createdAt: {
                                gte: today
                            }
                        }
                    }),

                    // Total products
                    prisma.product.count(),

                    // Out of stock products
                    prisma.product.count({
                        where: {
                            stockQuantity: 0
                        }
                    }),

                    // Low stock products (less than 10)
                    prisma.product.count({
                        where: {
                            stockQuantity: {
                                gt: 0,
                                lte: 10
                            }
                        }
                    })
                ]);

                const stats: IDashboardStats = {
                    users: {
                        total: totalUsers,
                        activeUsers,
                        newUsersToday,
                        usersByStatus: [
                            {
                                status: 'ACTIVE',
                                count: usersByStatus.find(s => s.isActive)?._count || 0
                            },
                            {
                                status: 'INACTIVE',
                                count: usersByStatus.find(s => !s.isActive)?._count || 0
                            }
                        ]
                    },
                    orders: {
                        total: totalOrders,
                        totalRevenue: orderStats._sum.totalAmount || 0,
                        averageOrderValue: orderStats._avg.totalAmount || 0,
                        ordersToday,
                        revenueToday: orderStats._sum.totalAmount || 0
                    },
                    products: {
                        total: products,
                        outOfStock: outOfStockProducts,
                        lowStock: lowStockProducts
                    }
                };

                return stats;
            },
            300 // Cache for 5 minutes
        );

        res.json({
            status: 'success',
            data: result
        });
    } catch (error) {
        console.error('Error in getDashboardStats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch dashboard stats'
        });
    }
};

// Get order analytics
export const getOrderAnalytics = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const result = await cacheWrapper(
            CACHE_KEYS.ORDER_ANALYTICS,
            async () => {
                const today = new Date();
                const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
                const previousThirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));

                const [
                    totalOrders,
                    totalRevenue,
                    averageOrderValue,
                    statusDistribution,
                    dailyOrders,
                    topProducts,
                    paymentMethodStats,
                    customerStats,
                    hourlyDistribution,
                    couponStats,
                    previousPeriodStats,
                    locationStats,
                    deliveryStats
                ] = await Promise.all([
                    // Total orders
                    prisma.order.count(),

                    // Total revenue
                    prisma.order.aggregate({
                        _sum: { totalAmount: true }
                    }),

                    // Average order value
                    prisma.order.aggregate({
                        _avg: { totalAmount: true }
                    }),

                    // Status distribution
                    prisma.order.groupBy({
                        by: ['status'],
                        _count: true
                    }),

                    // Daily orders for last 30 days
                    prisma.order.groupBy({
                        by: ['createdAt'],
                        where: {
                            createdAt: {
                                gte: thirtyDaysAgo
                            }
                        },
                        _count: true,
                        _sum: { totalAmount: true }
                    }),

                    // Top selling products
                    prisma.orderItem.groupBy({
                        by: ['productId'],
                        where: {
                            order: {
                                createdAt: {
                                    gte: thirtyDaysAgo
                                }
                            }
                        },
                        _sum: {
                            quantity: true,
                            price: true
                        },
                        orderBy: {
                            _sum: {
                                quantity: 'desc'
                            }
                        },
                        take: 10
                    }),

                    // Payment method distribution
                    prisma.order.groupBy({
                        by: ['paymentMethod'],
                        where: {
                            createdAt: {
                                gte: thirtyDaysAgo
                            }
                        },
                        _count: true,
                        _sum: {
                            totalAmount: true
                        }
                    }),

                    // Customer statistics
                    prisma.order.groupBy({
                        by: ['userId'],
                        where: {
                            createdAt: {
                                gte: thirtyDaysAgo
                            }
                        },
                        _count: true,
                        _sum: {
                            totalAmount: true
                        }
                    }),

                    // Hourly order distribution
                    prisma.order.groupBy({
                        by: ['createdAt'],
                        where: {
                            createdAt: {
                                gte: thirtyDaysAgo
                            }
                        },
                        _count: true
                    }),

                    // Coupon usage statistics
                    prisma.order.findMany({
                        where: {
                            createdAt: {
                                gte: thirtyDaysAgo
                            },
                            NOT: {
                                couponId: null
                            }
                        },
                        select: {
                            couponId: true,
                            discountAmount: true,
                            totalAmount: true
                        }
                    }),

                    // Previous period statistics
                    prisma.order.aggregate({
                        where: {
                            createdAt: {
                                gte: previousThirtyDaysAgo,
                                lt: thirtyDaysAgo
                            }
                        },
                        _count: true,
                        _sum: {
                            totalAmount: true
                        }
                    }),

                    // Location statistics
                    prisma.order.groupBy({
                        by: ['shippingAddressId'],
                        where: {
                            createdAt: {
                                gte: thirtyDaysAgo
                            }
                        },
                        _count: true,
                        _sum: {
                            totalAmount: true
                        }
                    }),

                    // Delivery time statistics
                    prisma.order.findMany({
                        where: {
                            createdAt: {
                                gte: thirtyDaysAgo
                            },
                            status: OrderStatus.DELIVERED,
                            deliveredAt: {
                                not: null
                            }
                        },
                        select: {
                            shippingAddressId: true,
                            createdAt: true,
                            deliveredAt: true
                        }
                    })
                ]);

                // Get product details for top products
                const topProductDetails = await prisma.product.findMany({
                    where: {
                        id: {
                            in: topProducts.map(p => p.productId)
                        }
                    },
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        category: true
                    }
                });

                // Get address details for location analytics
                const addressIds = locationStats.map(stat => stat.shippingAddressId);
                const addresses = await prisma.address.findMany({
                    where: {
                        id: {
                            in: addressIds
                        }
                    }
                });

                // Process location statistics
                const stateStats = new Map();
                const cityStats = new Map();
                const pincodeStats = new Map();

                locationStats.forEach(stat => {
                    const address = addresses.find(a => a.id === stat.shippingAddressId);
                    if (!address) return;

                    // State stats
                    const stateKey = address.state;
                    const stateData = stateStats.get(stateKey) || { orders: 0, revenue: 0 };
                    stateData.orders += stat._count;
                    stateData.revenue += stat._sum.totalAmount || 0;
                    stateStats.set(stateKey, stateData);

                    // City stats
                    const cityKey = `${address.city}-${address.state}`;
                    const cityData = cityStats.get(cityKey) || { 
                        city: address.city,
                        state: address.state,
                        orders: 0,
                        revenue: 0
                    };
                    cityData.orders += stat._count;
                    cityData.revenue += stat._sum.totalAmount || 0;
                    cityStats.set(cityKey, cityData);

                    // Pincode stats
                    const pincodeKey = address.pincode;
                    const pincodeData = pincodeStats.get(pincodeKey) || {
                        pincode: address.pincode,
                        city: address.city,
                        state: address.state,
                        orders: 0,
                        deliveryTimes: []
                    };
                    pincodeData.orders += stat._count;
                    pincodeStats.set(pincodeKey, pincodeData);
                });

                // Calculate average delivery times
                deliveryStats.forEach(order => {
                    const address = addresses.find(a => a.id === order.shippingAddressId);
                    if (!address || !order.deliveredAt) return;

                    const pincodeData = pincodeStats.get(address.pincode);
                    if (pincodeData) {
                        const deliveryTime = order.deliveredAt.getTime() - order.createdAt.getTime();
                        pincodeData.deliveryTimes.push(deliveryTime);
                    }
                });

                // Calculate average delivery times for each pincode
                pincodeStats.forEach(data => {
                    if (data.deliveryTimes.length > 0) {
                        const avgTime = data.deliveryTimes.reduce((a: number, b: number) => a + b, 0) / data.deliveryTimes.length;
                        data.averageDeliveryTime = Math.round(avgTime / (1000 * 60 * 60 * 24)); // Convert to days
                    }
                    delete data.deliveryTimes;
                });

                // Process hourly distribution
                const hourlyOrderCounts = new Array(24).fill(0);
                hourlyDistribution.forEach(order => {
                    const hour = new Date(order.createdAt).getHours();
                    hourlyOrderCounts[hour] += order._count;
                });

                // Calculate customer metrics
                const totalCustomers = customerStats.length;
                const repeatCustomers = customerStats.filter(c => c._count > 1).length;
                const averageOrdersPerCustomer = customerStats.reduce((acc, curr) => acc + curr._count, 0) / totalCustomers;
                const customerLifetimeValue = customerStats.reduce((acc, curr) => acc + (curr._sum.totalAmount || 0), 0) / totalCustomers;

                // Calculate period over period growth
                const currentPeriodRevenue = totalRevenue._sum.totalAmount || 0;
                const previousPeriodRevenue = previousPeriodStats._sum.totalAmount || 0;
                const revenueGrowth = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;
                const orderGrowth = ((totalOrders - previousPeriodStats._count) / previousPeriodStats._count) * 100;

                const analytics: IOrderAnalytics = {
                    totalOrders,
                    totalRevenue: totalRevenue._sum.totalAmount || 0,
                    averageOrderValue: averageOrderValue._avg.totalAmount || 0,
                    statusDistribution: statusDistribution.map(item => ({
                        status: item.status,
                        count: item._count
                    })),
                    dailyOrders: dailyOrders.map(day => ({
                        date: day.createdAt,
                        orders: day._count,
                        revenue: day._sum.totalAmount || 0
                    })),
                    topProducts: topProducts.map(product => ({
                        productId: product.productId,
                        quantity: product._sum.quantity || 0,
                        revenue: product._sum.price || 0,
                        productDetails: topProductDetails.find(p => p.id === product.productId)
                    })),
                    paymentAnalytics: {
                        methodDistribution: paymentMethodStats.map(item => ({
                            method: item.paymentMethod,
                            count: item._count,
                            volume: item._sum.totalAmount || 0
                        }))
                    },
                    customerAnalytics: {
                        totalCustomers,
                        repeatCustomers,
                        repeatCustomerRate: (repeatCustomers / totalCustomers) * 100,
                        averageOrdersPerCustomer,
                        customerLifetimeValue
                    },
                    timeAnalytics: {
                        hourlyDistribution: hourlyOrderCounts,
                        peakHour: hourlyOrderCounts.indexOf(Math.max(...hourlyOrderCounts))
                    },
                    promotionAnalytics: {
                        couponUsage: couponStats.length,
                        totalDiscount: couponStats.reduce((acc, curr) => acc + (curr.discountAmount || 0), 0),
                        averageDiscount: couponStats.reduce((acc, curr) => acc + (curr.discountAmount || 0), 0) / couponStats.length || 0
                    },
                    growthAnalytics: {
                        revenueGrowth,
                        orderGrowth,
                        previousPeriodRevenue,
                        previousPeriodOrders: previousPeriodStats._count
                    },
                    locationAnalytics: {
                        stateDistribution: Array.from(stateStats.entries()).map(([state, data]) => ({
                            state,
                            orders: data.orders,
                            revenue: data.revenue
                        })),
                        cityDistribution: Array.from(cityStats.values()),
                        topCities: Array.from(cityStats.values())
                            .sort((a: { orders: number }, b: { orders: number }) => b.orders - a.orders)
                            .slice(0, 10),
                        deliveryZones: Array.from(pincodeStats.values())
                    }
                };

                return analytics;
            },
            300 // Cache for 5 minutes
        );

        res.json({
            status: 'success',
            data: result
        });
    } catch (error) {
        console.error('Error in getOrderAnalytics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch order analytics'
        });
    }
};