import React from 'react';

// Test JSX file for custom transformation
const MyComponent = ({ name, age }) => {
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

const CustomButton = ({ children, onClick }) => (
  <button onClick={onClick} className="custom-btn">
    {children}
  </button>
);

export default MyComponent;
