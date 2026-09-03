import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Notification = {
  id: string;
  message: string;
  created_at: string;
};

const NotificationPanel = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Subscribe to real-time notifications
    const channel = supabase
      .channel('property-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'properties'
        },
        (payload) => {
          const newNotification = {
            id: payload.new.id,
            message: `Someone just bought a home at ${payload.new.location}!`,
            created_at: new Date().toISOString()
          };
          setNotifications(prev => [newNotification, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-center mb-4">
        <Bell className="h-5 w-5 text-blue-600 mr-2" />
        <h3 className="font-semibold text-gray-900">Recent Activity</h3>
      </div>
      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md"
          >
            {notification.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationPanel;