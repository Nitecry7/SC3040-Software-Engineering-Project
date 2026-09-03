import React from 'react';
import { Shield, Clock, Award, Users } from 'lucide-react';

const WhyChooseUs = () => {
  const features = [
    {
      icon: <Shield className="h-8 w-8 text-blue-600" />,
      title: "Trusted Partners",
      description: "All our properties are verified and from trusted partners"
    },
    {
      icon: <Clock className="h-8 w-8 text-blue-600" />,
      title: "24/7 Support",
      description: "Our team is available round the clock to assist you"
    },
    {
      icon: <Award className="h-8 w-8 text-blue-600" />,
      title: "Best Deals",
      description: "Get the best property deals in Singapore"
    },
    {
      icon: <Users className="h-8 w-8 text-blue-600" />,
      title: "Expert Agents",
      description: "Work with experienced and certified real estate agents"
    }
  ];

  return (
    <div className="bg-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Why Choose SG Homie</h2>
          <p className="mt-4 text-lg text-gray-600">
            We're committed to providing the best real estate experience in Singapore
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div key={index} className="text-center">
              <div className="flex justify-center">{feature.icon}</div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhyChooseUs;