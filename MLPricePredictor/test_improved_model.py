import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder, RobustScaler
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
import warnings
warnings.filterwarnings('ignore')

print("Loading and preprocessing data...")
# Load data
df = pd.read_csv('HDB_resale_prices_from_Jan_2017.csv')
df['month'] = pd.to_datetime(df['month'])

# Create basic features
print("Creating features...")
df['year'] = df['month'].dt.year
df['month_num'] = df['month'].dt.month
df['quarter'] = df['month'].dt.quarter
df['property_age'] = df['year'] - df['lease_commence_date']
df['remaining_lease'] = 99 - df['property_age']
df['price_per_sqm'] = df['resale_price'] / df['floor_area_sqm']
df['storey_range_start'] = df['storey_range'].apply(lambda x: int(x.split(' TO ')[0]))
df['storey_range_end'] = df['storey_range'].apply(lambda x: int(x.split(' TO ')[1]))
df['avg_storey'] = (df['storey_range_start'] + df['storey_range_end']) / 2

# Create advanced features
print("Creating advanced features...")
# Town-level aggregates
town_stats = df.groupby('town').agg({
    'resale_price': ['mean', 'std'],
    'floor_area_sqm': 'mean',
    'price_per_sqm': ['mean', 'std']
})

df['town_price_mean'] = df['town'].map(town_stats['resale_price']['mean'])
df['town_price_std'] = df['town'].map(town_stats['resale_price']['std'])
df['town_area_mean'] = df['town'].map(town_stats['floor_area_sqm']['mean'])
df['town_price_per_sqm_mean'] = df['town'].map(town_stats['price_per_sqm']['mean'])

# Flat type aggregates
flat_type_stats = df.groupby('flat_type').agg({
    'resale_price': ['mean', 'std'],
    'floor_area_sqm': 'mean'
})

df['flat_type_price_mean'] = df['flat_type'].map(flat_type_stats['resale_price']['mean'])
df['flat_type_area_mean'] = df['flat_type'].map(flat_type_stats['floor_area_sqm']['mean'])

# Interaction features
df['area_storey_interaction'] = df['floor_area_sqm'] * df['avg_storey']
df['lease_storey_interaction'] = df['remaining_lease'] * df['avg_storey']
df['area_lease_interaction'] = df['floor_area_sqm'] * df['remaining_lease']

# Moving averages
df = df.sort_values(['town', 'month'])
df['price_ma_3'] = df.groupby('town')['resale_price'].transform(lambda x: x.rolling(3, min_periods=1).mean())
df['price_ma_6'] = df.groupby('town')['resale_price'].transform(lambda x: x.rolling(6, min_periods=1).mean())

# Encode categorical variables
print("Encoding categorical variables...")
categorical_cols = ['town', 'flat_type', 'flat_model', 'street_name']
label_encoders = {}

for col in categorical_cols:
    label_encoders[col] = LabelEncoder()
    df[f'{col}_encoded'] = label_encoders[col].fit_transform(df[col])

# Handle outliers
print("Handling outliers...")
outlier_features = ['resale_price', 'floor_area_sqm', 'price_per_sqm']
iso_forest = IsolationForest(contamination=0.01, random_state=42)
outlier_labels = iso_forest.fit_predict(df[outlier_features])
df['is_outlier'] = outlier_labels
df_cleaned = df[df['is_outlier'] == 1]

# Prepare features
print("Preparing final feature set...")
feature_cols = [
    'floor_area_sqm', 'property_age', 'remaining_lease', 'price_per_sqm',
    'avg_storey', 'town_encoded', 'flat_type_encoded', 'flat_model_encoded',
    'street_name_encoded', 'year', 'month_num', 'quarter',
    'town_price_mean', 'town_price_std', 'town_area_mean', 'town_price_per_sqm_mean',
    'flat_type_price_mean', 'flat_type_area_mean',
    'area_storey_interaction', 'lease_storey_interaction', 'area_lease_interaction',
    'price_ma_3', 'price_ma_6'
]

X = df_cleaned[feature_cols]
y = df_cleaned['resale_price']

# Split data
print("Splitting data...")
train_idx = df_cleaned[df_cleaned['year'] < 2024].index
test_idx = df_cleaned[df_cleaned['year'] >= 2024].index

X_train, X_test = X.loc[train_idx], X.loc[test_idx]
y_train, y_test = y.loc[train_idx], y.loc[test_idx]

# Scale features
print("Scaling features...")
scaler = RobustScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train model with optimized parameters
print("\nTraining Random Forest model...")
rf_model = RandomForestRegressor(
    n_estimators=1000,
    max_depth=20,
    min_samples_split=2,
    min_samples_leaf=1,
    max_features='sqrt',
    bootstrap=True,
    max_samples=0.8,
    random_state=42,
    n_jobs=-1
)

rf_model.fit(X_train_scaled, y_train)

# Make predictions
print("Making predictions...")
y_pred = rf_model.predict(X_test_scaled)

# Calculate metrics
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
mae = mean_absolute_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print("\nModel Performance Metrics:")
print(f'RMSE: ${rmse:,.2f}')
print(f'MAE: ${mae:,.2f}')
print(f'R2 Score: {r2:.4f}')

# Feature importance analysis
print("\nTop 10 Most Important Features:")
feature_importance = pd.DataFrame({
    'feature': feature_cols,
    'importance': rf_model.feature_importances_
})
feature_importance = feature_importance.sort_values('importance', ascending=False)
print(feature_importance.head(10)) 