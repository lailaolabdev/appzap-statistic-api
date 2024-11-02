# 1. Query important statistic
http://localhost:3000/api/v1/statistics

# 2. Query restaurant with params
http://localhost:3000/api/v1/restaurants?status=PAID&hasPOS=true&paymentStatus=PAID


# 3. Query restaurants sorted by their income
http://localhost:3000/api/v1/restaurants/income?startDate=2024-01-01&endDate=2024-01-31
http://localhost:3000/api/v1/restaurants/income?startDate=2024-01-01&endDate=2024-01-31&restaurantIds=[64c725ab43f4d2001f2bd417,6447a2ef853b28001fb5b5e1]
