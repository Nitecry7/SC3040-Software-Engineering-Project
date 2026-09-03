import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, cross_val_score, TimeSeriesSplit
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.model_selection import GridSearchCV
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

def load_and_preprocess_data(file_path):
    """
    Load and preprocess the HDB resale price dataset
    """
    print("Loading dataset...")
    df = pd.read_csv(file_path)
    
    # Convert month to datetime
    df['month'] = pd.to_datetime(df['month'])
    
    # Create time-based features
    df['year'] = df['month'].dt.year
    df['month_num'] = df['month'].dt.month
    df['quarter'] = df['month'].dt.quarter
    
    # Calculate property age
    df['property_age'] = df['year'] - df['lease_commence_date']
    
    # Create remaining lease feature
    df['remaining_lease'] = 99 - df['property_age']
    
    # Calculate price per square meter
    df['price_per_sqm'] = df['resale_price'] / df['floor_area_sqm']
    
    # Create storey range features
    df['storey_range_start'] = df['storey_range'].apply(lambda x: int(x.split(' TO ')[0]))
    df['storey_range_end'] = df['storey_range'].apply(lambda x: int(x.split(' TO ')[1]))
    df['avg_storey'] = (df['storey_range_start'] + df['storey_range_end']) / 2
    
    # Create location-based features
    town_avg_price = df.groupby('town')['resale_price'].mean()
    df['town_avg_price'] = df['town'].map(town_avg_price)
    
    return df

def encode_categorical_features(df):
    """
    Encode categorical variables using LabelEncoder
    """
    print("Encoding categorical variables...")
    categorical_cols = ['town', 'flat_type', 'flat_model', 'street_name']
    label_encoders = {}
    
    for col in categorical_cols:
        label_encoders[col] = LabelEncoder()
        df[f'{col}_encoded'] = label_encoders[col].fit_transform(df[col])
    
    return df, label_encoders

def prepare_features(df):
    """
    Prepare feature matrix X and target variable y
    """
    feature_cols = [
        'floor_area_sqm', 'property_age', 'remaining_lease', 'price_per_sqm',
        'avg_storey', 'town_encoded', 'flat_type_encoded', 'flat_model_encoded',
        'street_name_encoded', 'year', 'month_num', 'quarter', 'town_avg_price'
    ]
    
    X = df[feature_cols]
    y = df['resale_price']
    
    return X, y, feature_cols

def train_random_forest(X_train_scaled, y_train):
    """
    Train Random Forest model with hyperparameter tuning
    """
    print("Training Random Forest model with hyperparameter tuning...")
    
    rf_model = RandomForestRegressor(random_state=42)
    
    param_grid = {
        'n_estimators': [200, 500],
        'max_depth': [10, 15, 20],
        'min_samples_split': [2, 5],
        'min_samples_leaf': [1, 2],
        'max_features': ['sqrt', 'log2']
    }
    
    tscv = TimeSeriesSplit(n_splits=5)
    grid_search = GridSearchCV(
        estimator=rf_model,
        param_grid=param_grid,
        cv=tscv,
        scoring='neg_mean_squared_error',
        n_jobs=-1,
        verbose=1
    )
    
    grid_search.fit(X_train_scaled, y_train)
    
    print("\nBest parameters:", grid_search.best_params_)
    return grid_search.best_estimator_

def generate_future_data(df, label_encoders, feature_cols, start_year=2025, end_year=2045):
    """
    Generate future data for predictions
    """
    print(f"Generating future data from {start_year} to {end_year}...")
    
    towns = df['town'].unique()
    flat_types = df['flat_type'].unique()
    future_data = []
    
    for year in range(start_year, end_year + 1):
        for town in towns:
            for flat_type in flat_types:
                # Get the latest data for this town and flat type combination
                town_flat_data = df[(df['town'] == town) & (df['flat_type'] == flat_type)]
                
                # Skip if no data exists for this combination
                if len(town_flat_data) == 0:
                    continue
                    
                latest_data = town_flat_data.iloc[-1]
                
                for quarter in range(1, 5):
                    row = {
                        'town': town,
                        'flat_type': flat_type,
                        'year': year,
                        'quarter': quarter,
                        'month_num': quarter * 3,
                        'floor_area_sqm': latest_data['floor_area_sqm'],
                        'property_age': latest_data['property_age'] + (year - 2024),
                        'remaining_lease': latest_data['remaining_lease'] - (year - 2024),
                        'price_per_sqm': latest_data['price_per_sqm'],
                        'avg_storey': latest_data['avg_storey'],
                        'town_encoded': label_encoders['town'].transform([town])[0],
                        'flat_type_encoded': label_encoders['flat_type'].transform([flat_type])[0],
                        'flat_model_encoded': latest_data['flat_model_encoded'],
                        'street_name_encoded': latest_data['street_name_encoded'],
                        'town_avg_price': latest_data['town_avg_price']
                    }
                    future_data.append(row)
    
    return pd.DataFrame(future_data)

def create_visualization(historical_df, future_df, group_by='town'):
    """
    Create interactive visualization using plotly
    """
    print(f"Creating visualization for {group_by}...")
    
    historical_grouped = historical_df.groupby(['year', group_by])['resale_price'].mean().reset_index()
    historical_grouped['data_type'] = 'Historical'
    
    future_grouped = future_df.groupby(['year', group_by])['predicted_price'].mean().reset_index()
    future_grouped = future_grouped.rename(columns={'predicted_price': 'resale_price'})
    future_grouped['data_type'] = 'Predicted'
    
    combined_df = pd.concat([historical_grouped, future_grouped])
    
    fig = px.line(combined_df, 
                  x='year', 
                  y='resale_price',
                  color=group_by,
                  line_dash='data_type',
                  title=f'HDB Resale Price Trends by {group_by} (2017-2045)',
                  labels={'resale_price': 'Average Resale Price (SGD)',
                         'year': 'Year'})
    
    fig.add_vline(x=2024, line_dash='dash', line_color='gray',
                  annotation_text='Prediction Start')
    
    fig.update_layout(
        height=800,
        showlegend=True,
        hovermode='x unified',
        template='plotly_white'
    )
    
    # Save the plot as HTML
    fig.write_html(f'price_prediction_{group_by}.html')
    print(f"Visualization saved as price_prediction_{group_by}.html")

def main():
    # Load and preprocess data
    df = load_and_preprocess_data('HDB_resale_prices_from_Jan_2017.csv')
    
    # Encode categorical features
    df, label_encoders = encode_categorical_features(df)
    
    # Prepare features
    X, y, feature_cols = prepare_features(df)
    
    # Split data
    print("Preparing training and test data...")
    train_idx = df[df['year'] < 2024].index
    test_idx = df[df['year'] >= 2024].index
    
    X_train, X_test = X.loc[train_idx], X.loc[test_idx]
    y_train, y_test = y.loc[train_idx], y.loc[test_idx]
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train model
    best_model = train_random_forest(X_train_scaled, y_train)
    
    # Make predictions on test set
    y_pred = best_model.predict(X_test_scaled)
    
    # Calculate metrics
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print(f'\nModel Performance Metrics:')
    print(f'RMSE: ${rmse:,.2f}')
    print(f'MAE: ${mae:,.2f}')
    print(f'R2 Score: {r2:.4f}')
    
    # Feature importance analysis
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': best_model.feature_importances_
    })
    feature_importance = feature_importance.sort_values('importance', ascending=False)
    
    print("\nTop 10 Most Important Features:")
    print(feature_importance.head(10))
    
    # Generate future predictions
    future_df = generate_future_data(df, label_encoders, feature_cols)
    future_X = future_df[feature_cols]
    future_X_scaled = scaler.transform(future_X)
    future_predictions = best_model.predict(future_X_scaled)
    future_df['predicted_price'] = future_predictions
    
    # Create visualizations
    create_visualization(df, future_df, 'town')
    create_visualization(df, future_df, 'flat_type')

if __name__ == "__main__":
    main() 