import React from 'react';

// Test TSX file for custom transformation
interface Props {
  name: string;
  age: number;
}

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

const MyComponent: React.FC<Props> = ({ name, age }) => {
  return (
    <div className="container">
      <h1>Hello, {name}!</h1>
      <p>You are {age} years old.</p>
      <CustomButton onClick={() => console.log('clicked')}>
        Click me
      </CustomButton>
    </div>
  );
};

const CustomButton: React.FC<ButtonProps> = ({ children, onClick }) => (
  <button onClick={onClick} className="custom-btn">
    {children}
  </button>
);

export default MyComponent;
