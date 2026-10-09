#include<iostream>
int main()
{
    //test1
    std::cout << "Input three integers:";
    int x,y,z;
    std::cin >> x >> y >> z;
    std::cout << "Sum is" << x+y+z << '\n';
    std::cout << "Product is" << x*y*z << '\n';
    float Average = (x+y+z)/3.0f;
    std::cout << "Average is" << Average << '\n';

    //test2
//     std::cout << "Input three integers:";
//     float x,y,z;
//     std::cin >> x >> y >> z;
//     std::cout << "Sum is" << x+y+z;
//     std::cout << "Product is" << x*y*z;
//     float Average = (x+y+z)/3;
//     std::cout << "Average is" << Average;

//     //test3
//     const auto Pai = 3.14159;
//     std::cout << "radius:";
//     float r = 0;
//     std::cin >> r;
//     std::cout << "diameter:" << r*2 << '\n'; 
//
}
