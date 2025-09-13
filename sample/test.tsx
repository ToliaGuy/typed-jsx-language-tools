// needed for default ts
import React from 'react';
// needed for typed jsx extension
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

//đexport default MyComponent;



const Option = () =>
  (<option />) as any as "I should be showing below!";







const element = <Option />;



export default element;

