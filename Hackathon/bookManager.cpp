#include <iostream>
#include <string>
#include <vector>
#include <limits>
#include "book.h"
#define NOMINMAX
#include <windows.h>
void addbook(std::vector<book>& books)
{
    std::string newid;
    std::string newtitle;
    std::string newauther;
    std::cout << "编号:";
    std::getline(std::cin,newid);
    if(newid.empty())
    {
        std::cout << "图书编号不能为空";
        return;
    }
    for(const auto& bo:books)
    {
        if(newid == bo.getid())
        {
            std::cout << "您的图书编号与其他图书编号重复\n";
            return;
        }
    }
    std::cout << "书名:";
    std::getline(std::cin,newtitle);
    if(newtitle.empty())
    {
        std::cout << "书名不能为空";
        return;
    }
    std::cout << "作者:";
    std::getline(std::cin,newauther);
    if(newauther.empty())
    {
        std::cout << "作者不能为空";
        return;
    }
    books.emplace_back(newtitle,newid,newauther);
}
void showbook(const std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有添加图书\n";
        return;
    }
    for(const auto& bo: books)
    {
        bo.showinfo();
    }
}
book* findbook(std::vector<book>& books,const std::string& targetid)
{
    for(auto& bo:books)
    {
        if(bo.getid() == targetid)
        {
            return &bo;
        }
    }
    return nullptr;
}
void searchbook(std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "您的系统内没有图书\n";
        return;
    }
    std::string targetid;
    std::cout << "请输入您要查找的图书编号:";
    std::getline(std::cin,targetid);
    const book* result = findbook(books,targetid);
    if(result == nullptr)
    {
        std::cout << "图书系统内没有该图书\n";
        return;
    }
    else
    {
        result -> showinfo();
    }
}

void borrowbook(std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有图书\n";
        return;
    }
    std::string targetid;
    std::cout << "请输入图书编号:";
    std::getline(std::cin,targetid);
    book* result;
    result = findbook(books,targetid);
    if(result == nullptr)
    {
        std::cout << "没有找到该图书\n";
        return;
    }
    else
    {
        result -> borrow();
        return;
    }

}
void returning(std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有图书\n";
        return;
    }
    std::string targetid;
    std::cout << "请输入图书编号:";
    std::getline(std::cin,targetid);
    book* result = findbook(books,targetid);
    if(result == nullptr)
    {
        std::cout << "未能找到该图书\n";
        return;
    }
    else
    {
        result -> returnbook();
        return;
    }
}
int main()
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    std::vector<book> books;
    int choice = -1;
    do
    {
        std::cout << "====图书馆管理系统====\n";
        std::cout << "1.添加图书\n";
        std::cout << "2.显示全部图书\n";
        std::cout << "3.根据编号查找图书\n";
        std::cout << "4.根据编号借出图书\n";
        std::cout << "5.根据编号归还图书\n";
        std::cout << "0.退出系统\n";
        if(!(std::cin >> choice))
        {
            std::cin.clear();
            std::cin.ignore(
                std::numeric_limits<std::streamsize>::max(),
                '\n'
            );
            std::cout << "请输入正确的选择\n";
            choice = -1;
            continue;
        }
        std::cin.ignore(
            std::numeric_limits<std::streamsize>::max(),
            '\n'
        );
        switch(choice)
        {
            case 1:
                addbook(books);
                break;
            case 2:
                showbook(books);
                break;
            case 3:
                searchbook(books);
                break;
            case 4:
                borrowbook(books);
                break;
            case 5:
                returning(books);
                break;
            case 0:
                std::cout << "您已成功退出系统\n";
                break;
            default:
                std::cout << "无效输入\n";
                break;
        }
    }while(choice != 0);
    return 0;
}