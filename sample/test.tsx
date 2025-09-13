import React from 'react';

function createElement(...args: any){
  return "test"
}

const MyComponent = ({
  name,
  age
}: {
  name: string,
  age: number
 }) => {
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

const element1 = MyComponent

const CustomButton = ({ children, onClick }: { children: any, onClick: () => void }) => (
  <button onClick={onClick} className="custom-btn">
    {children}
  </button>
);

export default MyComponent;
