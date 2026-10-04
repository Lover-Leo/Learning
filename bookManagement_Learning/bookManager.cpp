#include <iostream>
#include <string>
#include <vector>
#include <limits>
#include "book.h"
#define NOMINMAX
#include <windows.h>
#include<fstream>
#include<algorithm>
#include <cstddef>
void addbook(std::vector<book>& books)
{
    std::string newid;
    std::string newtitle;
    std::string newauther;
    borrowstatus newstatus = borrowstatus::available;
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
    books.emplace_back(newtitle,newid,newauther,newstatus);
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
book* findbook(
    std::vector<book>& books,
    const std::string& targetid
)
{
    auto result = std::find_if(
        books.begin(),
        books.end(),
        [&targetid](const book& bo)
        {
            return bo.getid() == targetid;
        }
    );
    if(result == books.end())
    {
        return nullptr;
    }
    return &(*result);
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
void savebook(const std::vector<book>& books)
{
    std::ofstream output("book.txt");
    if(!output)
    {
        std::cout << "文件未正常打开";
        return;
    }
    for(const auto& bo:books)
    {
        output << bo.getid() << '\n';
        output << bo.gettitle() << '\n';
        output << bo.getauther() <<'\n';
        output << static_cast<int>(bo.getstatus()) << '\n';
    }
}
void loadbook(std::vector<book>& books)
{
    std::ifstream input("book.txt");
    std::string id;
    std::string title;
    std::string auther;
    std::string statustext;
    borrowstatus status;
    while(getline(input,id))
    {
        if(
            !getline(input,title)||
            !getline(input,auther)||
            !getline(input,statustext)
        )
        {
            std::cout << "图书信息不完整\n";
            return;
        }
        if(statustext == "0")
        {
            status = borrowstatus::available;
        }
        else if(statustext == "1")
        {
            status = borrowstatus::borrowed;
        }
        else
        {
            std::cout << "借阅状态无效\n";
            continue;
        }
        books.emplace_back(title,id,auther,status);
    }
}
void sortbookbytitle(std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有图书\n";
        return;
    }
    std::sort(
        books.begin(),
        books.end(),
        [](const book& left,const book& right)
        {
            return left.gettitle() < right.gettitle();
        }
    );
    std::cout << "已按照书名排序\n";
}
void sortbookbyid(std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有图书\n";
        return;
    }
    std::sort(
        books.begin(),
        books.end(),
        [](const book& left,const book& right)
        {
            return left.getid() < right.getid();
        }
    );
    std::cout << "已按照图书编号排序\n";
}
void countbook(const std::vector<book>& books)
{
    std::size_t allcount = books.size();
    auto borrowedcount = std::count_if(
        books.begin(),
        books.end(),
        [](const book& bo)
        {
            return bo.getstatus() == borrowstatus::borrowed;
        }
    );
    std::size_t availablecount = allcount - borrowedcount;
    std::cout << "图书总量:" << allcount << '\n';
    std::cout << "已借出:" << borrowedcount << '\n';
    std::cout << "未借出:" << availablecount << '\n';
}
void deletebook(std::vector<book>& books)
{
    if(books.empty())
    {
        std::cout << "系统内没有图书\n";
        return;
    }
    std::string deleteid;
    std::cout << "请输入要删除的图书编号:";
    std::getline(std::cin,deleteid);
    auto newend = std::remove_if(
        books.begin(),
        books.end(),
        [deleteid](const book& bo)
        {
           return bo.getid() == deleteid;
        }
    );
    if(newend == books.end())
    {
        std::cout << "没有找到该图书\n";
        return;
    }
    books.erase(newend,books.end());
}
int main()
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    std::vector<book> books;
    loadbook(books);
    int choice = -1;
    do
    {
        std::cout << "====图书馆管理系统====\n";
        std::cout << "1.添加图书\n";
        std::cout << "2.显示全部图书\n";
        std::cout << "3.根据编号查找图书\n";
        std::cout << "4.根据编号借出图书\n";
        std::cout << "5.根据编号归还图书\n";
        std::cout << "6.根据书名排序\n";
        std::cout << "7.根据图书编号排序\n";
        std::cout << "8.统计所有图书\n";
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
            case 6:
                sortbookbytitle(books);
                break;
            case 7:
                sortbookbyid(books);
                break;
            case 8:
                countbook(books);
                break;
            case 0:
                std::cout << "您已成功退出系统\n";
                savebook(books);
                break;
            default:
                std::cout << "无效输入\n";
                break;
        }
    }while(choice != 0);
    return 0;
}