#include<iostream>
#include<string>
#include<vector>
#include<windows.h>
enum class borrowstatus
{
    available,
    borrowed
};
class book
{
    private:
        std::string id;
        std::string title;
        std::string auther;
        borrowstatus status;
    public:
        book(const std::string& newtitle,const std::string& newid,const std::string& newauther);
        const std::string& getid() const;
        const std::string& gettitle() const;
        const std::string& getauther() const;
        borrowstatus getstatus() const; 
        void showinfo() const;
        bool borrow();
        bool returnbook();
};
book::book(const std::string& newtitle,const std::string& newid,const std::string& newauther):
title(newtitle),id(newid),auther(newauther),status(borrowstatus::available)
{

}
const std::string& book::getid() const
{
    return id;
}
const std::string& book::gettitle() const
{
    return title;
}
borrowstatus book::getstatus() const
{
    return status;
}
bool book::borrow()
{
    if(status == borrowstatus::borrowed)
    {
        std::cout << "未能成功借阅该图书\n";
        return false;
    }
    else
    {
        std::cout << "已成功借阅该图书";
        status = borrowstatus::borrowed;
        return true;
    }
}
void book::showinfo() const
{
    std::cout << "书名:" << title << "\n";
    std::cout << "编号:" << id << "\n";
    std::cout << "作者:" << auther << "\n";
    std::cout << "是否借出:" ;
    if(status == borrowstatus::borrowed)
    {
        std::cout << "已借出\n";
    }
    else
    {
        std::cout << "未借出\n";
    }
    std::cout << "====================\n";
}
const std::string& book::getauther() const
{
    return auther;
}
void addbook(std::vector<book>& books)
{
    std::string newid;
    std::string newtitle;
    std::string newauther;
    std::cout << "编号:";
    std::getline(std::cin >> std::ws,newid);
    for(const auto& bo: books)
    {
        if(newid == bo.getid())
        {
            std::cout << "您的图书编号与其他图书编号重复\n";
            return;
        }
    }
    std::cout << "书名:";
    std::getline(std::cin,newtitle);
    std::cout << "作者:";
    std::getline(std::cin,newauther);
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
    std::getline(std::cin >> std::ws,targetid);
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
bool book::returnbook()
{
    if(status == borrowstatus::available)
    {
        std::cout << "该图书未借出\n";
        return false;
    }
    else
    {
        std::cout << "已成功归还该图书\n";
        status = borrowstatus::available;
        return true;
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
    std::getline(std::cin >> std::ws,targetid);
    bool result;
    result = findbook(books,targetid);
    if(result = true)
    std::cout << "没有找到该图书\n";
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
    std::getline(std::cin >> std::ws,targetid);
    for(auto& bo:books)
    {
        if(bo.getid() == targetid)
        {
            bo.returnbook();
            return;
        }
    }
    std::cout << "系统中未能找到该编号\n";
}
int main()
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);
    std::vector<book> books;
    int choice;
    do
    {
        std::cout << "====图书馆管理系统====\n";
        std::cout << "1.添加图书\n";
        std::cout << "2.显示全部图书\n";
        std::cout << "3.根据编号查找图书\n";
        std::cout << "4.根据编号借出图书\n";
        std::cout << "5.根据编号归还图书\n";
        std::cout << "0.退出系统\n";
        std::cin >> choice;
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