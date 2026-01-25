# 1. Query important statistic
http://localhost:3000/api/v1/statistics

response:


# 2. Query restaurant with params
http://localhost:3000/api/v1/restaurants?status=PAID&hasPOS=true&paymentStatus=PAID


# 3. Query restaurants sorted by their income
http://localhost:3000/api/v1/restaurants/income?startDate=2024-10-01&endDate=2024-10-31

http://localhost:3000/api/v1/restaurants/income?startDate=2024-10-01&endDate=2024-10-31&restaurantIds=64c725ab43f4d2001f2bd417,6447a2ef853b28001fb5b5e1

# 4. Query best selling menus
http://localhost:3000/api/v1/menus/best_selling_menus?startDate=2024-10-01&endDate=2024-10-31

http://localhost:3000/api/v1/menus/best_selling_menus?menuLimit=10&startDate=2024-09-01&endDate=2024-09-31&restaurantIds=64c725ab43f4d2001f2bd417,6447a2ef853b28001fb5b5e1